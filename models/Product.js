const mongoose = require('mongoose');

const productSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    category: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: function () {
        return this.tag !== 'Donate';
      },
    },
    priceCategory: {
      type: String,
      required: function () {
        return this.tag !== 'Donate';
      },
    },
    image: {
      type: String,
    },
    location: {
      type: String,
    },
    tag: {
      type: String,
    },
    uploader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Reference to the User model
      required: true,
    },
    availability: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model('Product', productSchema);

module.exports = Product;