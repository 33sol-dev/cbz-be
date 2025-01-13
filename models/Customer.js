// models/Customer.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CustomerSchema = new Schema(
  {
    full_name: { type: String },
    phone_number: { type: String, required: true },
    assignedTo: { type: String }, // Phone number of the customer
    email: { type: String },
    upiId: { type: String },
    payment_details: {
      upi_ids: [{ type: String }],
      bank_details: [
        {
          account_number: { type: String },
          ifsc: { type: String },
        },
      ],
    },
    company: { type: Schema.Types.ObjectId, ref: 'Company' },
    last_campaign_details: {
      campaign_id: { type: Schema.Types.ObjectId, ref: 'Campaign' },
      details_user_shared: { type: Schema.Types.Mixed },
      money_they_received: { type: Number },
    },
    docs: [
      {
        doc_type: { type: String },
        doc_url: { type: String },
      },
    ],
    social_ids: [
      {
        platform: { type: String }, // e.g., 'facebook', 'instagram'
        id: { type: String },
      },
    ],
    custom_fields: { type: Schema.Types.Mixed }, // For dynamic fields per brand 
    address: { type: String }
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

module.exports = mongoose.model('Customer', CustomerSchema);

