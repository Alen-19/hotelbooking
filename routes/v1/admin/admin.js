const express = require('express');
const router = express.Router();
const jsonwebtoken = require('jsonwebtoken');
const bcryptjs = require('bcryptjs'); // used for password encyption
const { login } = require('../../../models/login');
const emailhelper = require('../../../controls/email'); // importing email control
const { isAdmin } = require('../../../controls/middleware');
const Otp = require('../../../models/otp');
const token = require('../../../models/token'); // importing token control
const { Categories, Rooms } = require('../../../models/categories')
// const { Booking } = require('../../../models/booking'); // Importing Booking model
const PdfPrinter = require('pdfmake');
const path = require('path');

function validateEmail(email) {
    const emailRegex = /^(?=[^@]*[a-zA-Z]{3,})[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/;
    return emailRegex.test(email);
}

router.post('/v1/admin/register', async (request,response) => {
    console.log(request.body); // first is request and second is response we can give any names
    try {        
        const { name, email, password, phone, role } =  request.body; // destructuring the request body 
        if(!email || !password || !name || !phone || !role) 
            {
            return response.status(400).json(
                {
                     message: 'Please fill all the fields' 
                });
            }
        else if (role !== 'admin' && role !== 'enduser') {
            return response.status(400).json(
                {
                    message: 'Role must be either admin or enduser'
                });
        }
        if (!validateEmail(email)) {
            return response.status(400).json({
                status: false,
                message: 'Please enter a valid email address'
            });
        }

        if (!/^[a-zA-Z\s]{2,50}$/.test(name)) {
            return response.status(400).json({
                status: false,
                message: 'Name should be 2-50 characters long and contain only letters and spaces'
            });
        }
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,}$/.test(password)) {
            return response.status(400).json({
                status: false,
                message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character'
            });
        }
        if (!/^[6-9]\d{9}$/.test(phone)) {
            return response.status(400).json({
                status: false,
                message: 'Please enter a valid 10-digit mobile number starting with 6-9'
            });
        }
        const existingUser = await login.findOne({ email: email }); // check if the user already exists
        if (existingUser) {
            return response.status(400).json(
                {
                    message: 'User already exists with this email'
                });
        }
        const hashedpassword = await bcryptjs.hash(password, 10); // 10 is the number of times hashed
        const newuser = new login(  //passed to the variables
            {
                name : name,
                password : hashedpassword,
                email : email,
                phone : phone,
                role : role
             });
            await newuser.save();
            const otp = Math.floor(100000 + Math.random() * 900000); // Generate a 6-digit OTP
            const result = await emailhelper.sendTextEmail(email,'Otp Verification',`Your OTP is: ${otp}`);
            const newotp = new Otp({
                loginid: newuser._id,
                otp: otp,
                });
                await newotp.save();
            return response.status(200).json({ status: true, message: 'Email sent successfully', result: result });
         }
    catch (error) {
        console.log(error);
        response.status(500).json(
            {
                status : false,
                message : "Internal Server Error"
            });  
    }

});
router.post('/v1/admin/login', async (request,response) =>
    {
        try {
            const { email, password } = request.body
                    if (!validateEmail(email)) {
                        return response.status(400).json({
                            status: false,
                            message: 'Please enter a valid email address'
                        });
                    }  
            const user = await login.findOne({ email: email });
            if(!email || !password) {
                return response.status(400).json({ message: 'Please fill all the fields' });
            }
            
            if (!user) {
                return response.status(404).json({ message: 'Invalid email' });
            }

            if (!user.status) {
            return response.status(403).json({ 
                status: false,
                message: 'Your account has been deactivated. Please contact administrator.' 
            });
            }
                const isMatch = await bcryptjs.compare(password, user.password);
                if (!isMatch) 
                    {
                        return response.status(401).json({ message: 'Invalid password' });
                    }
                if (user.isverified == false) {
                        return response.status(401).json({ status: false, message: 'Please verify your email first' });
                    }
                   const payload = {
                               id: user._id,
                               email: user.email,
                               role: user.role
                           };
                   
                           const tokenval2 = jsonwebtoken.sign(payload, 'hehe123', { expiresIn: '1h' });
                           const newToken = new token({
                               loginid: user._id,
                               token: tokenval2
                           });
                           await newToken.save();

        return response.status(200).json({
            status: true,
            message: 'Login successful',
            tokenval2,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
                    }
                    catch (error) {
                        console.error('Error during login:', error);
                        return response.status(500).json(
                            {
                                status : false,
                                message : "Internal Server Error"
                                });
}});

router.post('/v1/admin/verifyotp', async (request, response) => {
    try {
        const { email, otp } = request.body;

        if (!email || !otp) {
            return response.status(400).json({ message: 'Please provide both email and OTP' });
        }

        const userrecord = await login.findOne({ email: email });
        if (!userrecord) {
            return response.status(404).json({ status: false, message: 'Email not found' });
        }

        const userOtp = await Otp.findOne({ loginid: userrecord._id, otp: String(otp) });
        if (!userOtp) {
            return response.status(404).json({ status: false, message: 'Invalid OTP or Email' });
        }

        // Optional: Check OTP expiry here if your Otp model has a timestamp

        await login.findByIdAndUpdate(userrecord._id, { isverified: true });

        return response.status(200).json({ status: true, message: 'OTP verified successfully' });
    } catch (error) {
        console.error('Error verifying OTP:', error);
        return response.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});


router.post('/v1/admin/addcategories', isAdmin, async (req, res) => {
    try {
        const { catname } = req.body;

        if (!catname) {
            return res.status(400).json({ status: false, message: 'Category name is required' });
        }

        // Check if the category already exists (case-insensitive match optional)
        const existingCategory = await Categories.findOne({ catname: catname });
        if (existingCategory) {
            return res.status(409).json({ status: false, message: 'Category already exists' });
        }

        // Save new category
        const newCategory = new Categories({ catname });
        await newCategory.save();

        res.status(201).json({ status: true, message: 'Category created successfully' });

    } catch (err) {
        console.log(err)
        console.error(err);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

router.put('/v1/admin/editcategories', isAdmin, async (req,res) => {
    try{
        const {id, catname} = req.body;
        if(!id || !catname){
            return res.status(400).json({status:false,message:'Category ID and name are required'})
        }
        const category = await Categories.findById(id);
        if(!category){
            return res.status(404).json({status:false,message:'Category not found'})
        }
        category.catname = catname;
        await category.save();
        res.status(200).json({status:true, message:'Category updated successfully'})
    }
    catch(err){
        console.error(err);
        res.status(500).json({status:false, message:'Internal Server Error'})
    }
})

router.delete('/v1/admin/delcategories',isAdmin, async (req,res) => {
    try{
        console.log(req.params);
        const {id} = req.body; // Assuming the ID is sent in the request body
        
        if(!id){
            return res.status(400).json({status:false,message:'Category ID is required'})
        }
        const category = await Categories.findByIdAndUpdate(id,{status:false});
        if(!category){
            return res.status(404).json({status:false,message:'Category not found'})
        }
        res.status(200).json({status:true, message:'Category deleted successfully'})
    }
    catch(err){
        console.error(err);
        res.status(500).json({status:false, message:'Internal Server Error'})
    }
})

router.get('/v1/admin/getcategories', isAdmin, async (req,res) => {
    try{
        const categoriesList = await Categories.find();
        res.status(200).json({status:true, data:categoriesList})
    }
    catch(err){
        console.error(err);
        res.status(500).json({status:false, message:'Internal Server Error'})
    }
})

router.post('/v1/admin/addrooms', isAdmin, async (request, response) => {
    try {
        const {noofrooms, catname, price, availablerooms} = request.body;
        if (!noofrooms || !catname || !price || !availablerooms) {
            return response.status(400).json({ message: 'Please fill all the fields' });
        }
        if (availablerooms > noofrooms) {
            return response.status(400).json({ 
                status: false,
                message: 'Available rooms cannot be greater than total number of rooms' 
            });
        }
  
        // 1. Find category by catname
        const category = await Categories.findOne({ catname: catname });
        if (!category) {
            return response.status(404).json({ message: 'Category not found with the provided catname' });
        }  
        // 2. Create room
        const room = new Rooms({
            noofrooms: noofrooms,
            catid: category._id,
            price: price,
            availablerooms: availablerooms // Assuming this is the number of rooms available
        });
        await room.save();
        return response.status(200).json({
            status: true,
            message: 'Room added successfully',
            room: room
        });
    } catch (error) {
        console.error('Error adding room:', error);
        return response.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

router.post('/v1/admin/editrooms',isAdmin, async (req,res) => {
    try {
        const {id, noofrooms, available, catid,price} = req.body;
        const room = await Rooms.findById(id);
        if (!room) {
            return res.status(404).json({status:false,message:'Room not found'});
        }
        if (!id  && !noofrooms && !available && !catid && !price) {
            return res.status(400).json({status:false,message:'Room ID and at least one field to update are required'});    
        }
        if(noofrooms){
            room.noofrooms = noofrooms;
        }
        if(available){
            room.available = available;
        }
        if(catid){
            room.catid = catid;
        }
        if(price){
            room.price = price;
        }
        await room.save();
        res.status(200).json({status:true,message:'Room updated successfully'});
    } catch (err) {
        console.error(err);
        res.status(500).json({status:false,message:'Internal Server Error'});
    }
})

router.get('/v1/admin/getrooms',isAdmin, async (req,res) => {
    try{
        const roomsList = await Rooms.find().populate('catid');
        res.status(200).json({status:true, data:roomsList})
    }
    catch(err){
        console.error(err);
        res.status(500).json({status:false, message:'Internal Server Error'})
    }
})

router.get('/v1/admin/getusers',isAdmin, async (req, res) => {
    try {
        const usersList = await login.find({ role: 'admin' }); // Exclude password and __v field
        res.status(200).json({ status: true, data: usersList });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

//update the active status of user in login schema as false
router.delete('/v1/admin/deleteuser/:id', isAdmin, async (req, res) => {
    try {
        const id  = req.params.id// Assuming the ID is sent in the request body
        
        if (!id) {
            return res.status(400).json({ status: false, message: 'User ID is required' });
        }
        
        const user = await login.findByIdAndUpdate(id, { status: false });
        if (!user) {
            return res.status(404).json({ status: false, message: 'User not found' });
        }
        
        res.status(200).json({ status: true, message: 'User deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});
    

// router.post('/v1/admin/booking', async (request, response) => {
//     try {
//         const { name, catname, numberofrooms, checkin, checkout, totalamount } = request.body;

//         // Validate input
//         if (!name || !catname || !numberofrooms || !checkin || !checkout) {
//             return response.status(400).json({ message: 'Please fill all the fields' });
//         }

//         // 1. Find user by name
//         const user = await login.findOne({ name: name });
//         if (!user) {
//             return response.status(404).json({ message: 'User not found with the provided name' });
//         }

//         // 2. Find category by catname
//         const category = await Categories.findOne({ catname: catname });
//         if (!category) {
//             return response.status(404).json({ message: 'Category not found with the provided catname' });
//         }

//         // 3. Find an available room with that category
//         const room = await Rooms.findOne({ catid: category._id,status: true });

//         if (!room) {
//             return response.status(404).json({ message: 'No available room found for the given category' });
//         }
//         const checkinDate = new Date(checkin);
//         const checkoutDate = new Date(checkout);
        
//         // Validate dates
//         if (isNaN(checkinDate.getTime()) || isNaN(checkoutDate.getTime())) {
//             return response.status(400).json({ message: 'Invalid date format' });
//         }
//         // Check if the number of rooms requested is available
//         if (room.numberofrooms < numberofrooms) {
//             return response.status(400).json({ message: 'Requested number of rooms exceeds limit' });
//         }
        
//         if (new Date(checkout) <= new Date(checkin)) {
//             return response.status(400).json({ message: 'Check-out date must be after check-in date' });
//         }

//         const days = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));
//         const tolamount = days * room.price * numberofrooms; // Calculate total amount
//         // 4. Create booking
//         const booking = new Booking({
//             loginid: user._id,
//             roomid: room._id,
//             numberofrooms,
//             checkin,
//             checkout,
//             totalamount : tolamount
//         });

//         await booking.save();

//         return response.status(200).json({
//             status: true,
//             message: 'Booking created successfully',
//             booking
//         });

//     } catch (error) {
//         console.error('Error creating booking:', error);
//         return response.status(500).json({ status: false, message: 'Internal Server Error' });
//     }
// });


const fonts = {
    Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
    }
};

const printer = new PdfPrinter(fonts);
router.get('/v1/admin/download-users', isAdmin, async (req, res) => {
  try {
    const users = await login.find();
    const tableBody = [
      ['Name', 'Email', 'Phone', 'Role', 'Status', 'Verified']  // Header row
    ];
    

    users.forEach(user => {
      tableBody.push([
        user.name || '',
        user.email || '',
        user.phone || '',
        user.role,
        user.status ? 'Active' : 'Inactive',
        user.isverified ? 'Yes' : 'No'
      ]);
    });

   const docDefinition = {
    defaultStyle: {
        font: 'Helvetica'  // Set default font
    },
    content: [
        { text: 'User Details Report', style: 'header' },
        {
            style: 'tableExample',
            table: {
                headerRows: 1,
                body: tableBody
            }
        }
    ],
    styles: {
        header: {
            fontSize: 18,
            bold: true,
            margin: [0, 0, 0, 10]
        },
        tableExample: {
            margin: [0, 5, 0, 15]
        }
    }
};

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="users.pdf"');

    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error('Error generating PDF:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



module.exports = router;