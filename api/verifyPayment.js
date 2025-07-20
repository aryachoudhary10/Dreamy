const crypto = require("crypto");
// You would need to connect to Firebase Admin here to update the user's status
// This part is more complex and would require service account keys.
// For now, let's just verify the signature.

export default async function handler(req, res) {
    const { order_id, payment_id, signature } = req.body;

    const body = order_id + "|" + payment_id;

    const expectedSignature = crypto
        .createHmac("sha256", process.env.REACT_APP_RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex");

    if (expectedSignature === signature) {
        // Here you would securely update Firestore to set hasPaid: true
        // For now, we just confirm it's valid.
        res.status(200).json({ success: true, message: "Payment verified successfully." });
    } else {
        res.status(400).json({ success: false, error: "Payment verification failed." });
    }
}