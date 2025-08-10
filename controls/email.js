const nodemailer = require('nodemailer');
const env = require("./config.gmail.env");
const {google} = require('googleapis');
const oauth2Client = new google.auth.OAuth2(
    env.ClientID,
    env.client_secret,
    env.redirect_url
);
oauth2Client.setCredentials({
    refresh_token: env.refresh_token
});

async function sendTextEmail(to, subject, body) {
    try {
        const accessToken = await oauth2Client.getAccessToken();
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: env.emailId,
                clientId: env.ClientID,
                clientSecret: env.client_secret,
                refreshToken: env.refresh_token,
                accessToken: accessToken
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        // Create the email options
        var mailOptions = {
            from: env.emailId,
            to: to,
            subject: subject,
            text: body
            //attachments:
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent successfully:', info.response);
            }
        });
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}
module.exports.sendTextEmail = sendTextEmail;  

// This code sets up a nodemailer transporter using OAuth2 for Gmail and defines a function to send text emails.
// It uses the googleapis library to handle OAuth2 authentication and nodemailer to send emails.
// The `sendTextEmail` function takes parameters for the recipient's email, subject, and body of the email.
// It creates a transporter with the necessary authentication details and sends the email using the `sendMail` method.
// If the email is sent successfully, it logs the response; otherwise, it logs any errors that occur.
// The module exports the `sendTextEmail` function for use in other parts of the application.
