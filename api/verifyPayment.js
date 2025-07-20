// const crypto = require("crypto");
// // You would need to connect to Firebase Admin here to update the user's status
// // This part is more complex and would require service account keys.
// // For now, let's just verify the signature.

// export default async function handler(req, res) {
//     const { order_id, payment_id, signature } = req.body;

//     const body = order_id + "|" + payment_id;

//     const expectedSignature = crypto
//         .createHmac("sha256", process.env.REACT_APP_RAZORPAY_KEY_SECRET)
//         .update(body.toString())
//         .digest("hex");

//     if (expectedSignature === signature) {
//         // Here you would securely update Firestore to set hasPaid: true
//         // For now, we just confirm it's valid.
//         res.status(200).json({ success: true, message: "Payment verified successfully." });
//     } else {
//         res.status(400).json({ success: false, error: "Payment verification failed." });
//     }
// }

const crypto = require("crypto");
const admin = require("firebase-admin");

// --- Firebase Admin Initialization ---
// This block ensures Firebase Admin is initialized only once.
try {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (error) {
  console.error("Firebase Admin Initialization Error:", error.message);
}

const db = admin.firestore();

export default async function handler(req, res) {
  console.log("--- verifyPayment function started ---");

  const { order_id, payment_id, signature } = req.body;
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    console.error("Auth token not found in headers.");
    return res.status(401).json({ error: "User is not authenticated." });
  }

  try {
    // Step 1: Verify the user's identity via Firebase Auth
    console.log("Verifying Firebase ID token...");
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;
    console.log(`Token verified for user ID: ${userId}`);

    // Step 2: Verify the payment signature from Razorpay
    console.log("Verifying Razorpay signature...");
    const body = order_id + "|" + payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.REACT_APP_RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === signature) {
      console.log("Signature is valid.");
      
      // Step 3: Update the user's document in Firestore
      console.log(`Attempting to write hasPaid:true to users/${userId}...`);
      const userDocRef = db.collection("users").doc(userId);
      await userDocRef.set({ hasPaid: true }, { merge: true });
      console.log("Firestore write successful!");
      
      res.status(200).json({ success: true });
    } else {
      console.error("Signature verification failed.");
      res.status(400).json({ error: "Payment verification failed." });
    }
  } catch (error) {
    console.error("--- An error occurred during verification ---", error);
    res.status(500).json({ error: "Internal server error." });
  }
}
