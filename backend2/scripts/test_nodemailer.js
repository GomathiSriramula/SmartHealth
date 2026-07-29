// Quick test to verify nodemailer import
const nodemailer = require("nodemailer");

console.log("nodemailer imported:", typeof nodemailer);
console.log("createTransporter exists:", typeof nodemailer.createTransport);
console.log("createTestAccount exists:", typeof nodemailer.createTestAccount);

// Test creating a transporter
try {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "test@test.com",
      pass: "test",
    },
  });
  console.log("✅ Transporter created successfully!");
} catch (error) {
  console.error("❌ Error creating transporter:", error.message);
}
