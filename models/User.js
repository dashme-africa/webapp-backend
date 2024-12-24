// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');

// const userSchema = mongoose.Schema(
//   {
//     fullName: {
//       type: String,
//       required: true,
//     },
//     username: {
//       type: String,
//       required: true,
//     },
//     email: {
//       type: String,
//       required: true,
//       unique: true,
//     },
//     password: {
//       type: String,
//       required: true,
//     },
//     bio: {
//       type: String,
//     },
//     profilePicture: {
//       type: String,
//     },
//     address: {
//       type: String,
//     },
//     accountName: {
//       type: String,  // Add the accountName field to store the bank account name
//     },
//     bankName: {
//       type: String,  // Optionally, you can store the bank name here
//     },
//     accountNumber: {
//       type: String,  // You might also want to store the account number
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// // Pre-save middleware to hash password
// userSchema.pre('save', async function (next) {
//   if (!this.isModified('password')) {
//     return next();
//   }
//   const salt = await bcrypt.genSalt(10);
//   this.password = await bcrypt.hash(this.password, salt);
//   next();
// });

// const User = mongoose.model('User', userSchema);
// module.exports = User;


const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    bio: {
      type: String,
    },
    profilePicture: {
      type: String,
    },
    address: {
      type: String,
    },
    accountName: {
      type: String,  // Add the accountName field to store the bank account name
    },
    bankName: {
      type: String,  // Optionally, you can store the bank name here
    },
    accountNumber: {
      type: String,  // You might also want to store the account number
    },
    isVerified: {
      type: Boolean,
      default: false,  // Default to false, assuming bank details are not verified initially
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.model('User', userSchema);
module.exports = User;
