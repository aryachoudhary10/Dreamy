const Razorpay = require("razorpay");

export default async function handler(req, res) {
  const razorpay = new Razorpay({
    key_id: process.env.REACT_APP_RAZORPAY_KEY_ID,
    key_secret: process.env.REACT_APP_RAZORPAY_KEY_SECRET,
  });

  const options = {
    amount: 1000, // 1000 paise = ₹10
    currency: "INR",
  };

  try {
    const order = await razorpay.orders.create(options);
    res.status(200).json({ orderId: order.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create order." });
  }
}