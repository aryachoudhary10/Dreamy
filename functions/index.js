const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Razorpay = require("razorpay");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

// Set your Razorpay keys in the Firebase environment using the CLI
// firebase functions:config:set razorpay.key_id="YOUR_KEY_ID"
// firebase functions:config:set razorpay.key_secret="YOUR_KEY_SECRET"
const razorpay = new Razorpay({
  key_id: functions.config().razorpay.key_id,
  key_secret: functions.config().razorpay.key_secret,
});

// Creates a Razorpay order
exports.createOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in.",
    );
  }
  const options = {
    amount: 1000, // Amount in paise (₹10)
    currency: "INR",
    receipt: `receipt_user_${context.auth.uid}`,
  };
  try {
    const order = await razorpay.orders.create(options);
    return {orderId: order.id};
  } catch (error) {
    console.error("Razorpay order creation failed:", error);
    throw new functions.https.HttpsError("internal", "Could not create order.");
  }
});

// Verifies the payment signature and updates the user's status
exports.verifyPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in.",
    );
  }
  const {order_id: orderId, payment_id: paymentId, signature} = data;
  const userId = context.auth.uid;

  const body = orderId + "|" + paymentId;

  const expectedSignature = crypto
      .createHmac("sha256", functions.config().razorpay.key_secret)
      .update(body.toString())
      .digest("hex");

  if (expectedSignature === signature) {
    // Payment is authentic. Update user's status in Firestore.
    const userDocRef = db.collection("users").doc(userId);
    await userDocRef.set({hasPaid: true}, {merge: true});
    return {success: true};
  } else {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Payment verification failed.",
    );
  }
});