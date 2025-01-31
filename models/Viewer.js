const mongoose = require("mongoose")


const ViewerSchema = new mongoose.Schema({
    campaign:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign',
    },
    merchant:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Merchant',
    },
    viewerMacAddress:{
        type: String,
        required: true,
    },

})

module.exports = mongoose.models["Viewer"] || mongoose.model("Viewer", ViewerSchema);