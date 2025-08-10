const express = require('express');
const router = express.Router();
const jsonwebtoken = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const { login } = require('../../../models/login');
const emailhelper = require('../../../controls/email');
const Otp = require('../../../models/otp');
const { Categories, Rooms } = require('../../../models/categories')
const { Booking } = require('../../../models/booking'); 
const path = require('path');

function validateEmail(email) {
    const emailRegex = /^(?=[^@]*[a-zA-Z]{3,})[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/;
    return emailRegex.test(email);
}

router.post('/v1/endusers/register', async (request,response) => {
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
router.post('/v1/endusers/login', async (request,response) =>
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
                        user: {
                            id: user._id,
                            role: user.role
                            }
                        }
                    const secretkey = "hai";
                    const token = jsonwebtoken.sign({payload},secretkey, { expiresIn : "1h"});
                    return response.status(200).json({ status : true,message : "Login Successfull",token : token});
                    }
                    catch (error) {
                        return response.status(500).json(
                            {
                                status : false,
                                message : "Internal Server Error"
                                });
}});

router.post('/v1/endusers/verifyotp', async (request, response) => {
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



router.post('/v1/endusers/booking', async (request, response) => {
    try {
        const { name, catname, numberofrooms, checkin, checkout, totalamount } = request.body;

        // Validate input
        if (!name || !catname || !numberofrooms || !checkin || !checkout) {
            return response.status(400).json({ message: 'Please fill all the fields' });
        }

        // 1. Find user by name
        const user = await login.findOne({ name: name });
        if (!user) {
            return response.status(404).json({ message: 'User not found with the provided name' });
        }

        // 2. Find category by catname
        const category = await Categories.findOne({ catname: catname });
        if (!category) {
            return response.status(404).json({ message: 'Category not found with the provided catname' });
        }

        // 3. Find an available room with that category
        const room = await Rooms.findOne({ catid: category._id,status: true });

        if (!room) {
            return response.status(404).json({ message: 'No available room found for the given category' });
        }
        const checkinDate = new Date(checkin);
        const checkoutDate = new Date(checkout);
        
        // Validate dates
        if (isNaN(checkinDate.getTime()) || isNaN(checkoutDate.getTime())) {
            return response.status(400).json({ message: 'Invalid date format' });
        }
        // Check if the number of rooms requested is available
        if (room.numberofrooms < numberofrooms) {
            return response.status(400).json({ message: 'Requested number of rooms exceeds limit' });
        }
        
        if (new Date(checkout) <= new Date(checkin)) {
            return response.status(400).json({ message: 'Check-out date must be after check-in date' });
        }

        const days = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));
        const tolamount = days * room.price * numberofrooms; // Calculate total amount
        // 4. Create booking
        const booking = new Booking({
            loginid: user._id,
            roomid: room._id,
            numberofrooms,
            checkin,
            checkout,
            totalamount : tolamount
        });

        await booking.save();

        return response.status(200).json({
            status: true,
            message: 'Booking created successfully',
            booking
        });

    } catch (error) {
        console.error('Error creating booking:', error);
        return response.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});
