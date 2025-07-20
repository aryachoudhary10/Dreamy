import { doc, setDoc } from 'firebase/firestore';

/**
 * Handles the Razorpay payment process by calling Vercel Serverless Functions.
 * @param {object} auth - The Firebase Auth instance.
 * @param {function} setErrorMessage - The state setter for displaying errors.
 */
export const handlePayment = async (auth, setErrorMessage) => {
    if (!auth.currentUser) {
        setErrorMessage("You must be logged in to make a payment.");
        return;
    }

    // These URLs now point to your Vercel API routes
    const createOrderUrl = '/api/createOrder';
    const verifyPaymentUrl = '/api/verifyPayment';

    try {
        // Step 1: Call the backend to create a Razorpay order
        const createOrderResponse = await fetch(createOrderUrl, { method: 'POST' });
        if (!createOrderResponse.ok) {
            throw new Error("Failed to create payment order.");
        }
        const { orderId } = await createOrderResponse.json();

        // Step 2: Configure and open the Razorpay checkout
        const options = {
            key: process.env.REACT_APP_RAZORPAY_KEY_ID,
            amount: "1000",
            currency: "INR",
            name: "LucidLens Access",
            description: "One-time fee for lifetime access.",
            order_id: orderId,
            handler: async function (response) {
                try {
                    // Step 3: After payment, send details to the backend for verification
                    const user = auth.currentUser;
                    const token = await user.getIdToken(); // Get the user's Firebase auth token

                    const verifyResponse = await fetch(verifyPaymentUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}` // Securely identify the user
                        },
                        body: JSON.stringify({
                            order_id: response.razorpay_order_id,
                            payment_id: response.razorpay_payment_id,
                            signature: response.razorpay_signature,
                        }),
                    });

                    if (!verifyResponse.ok) {
                        throw new Error("Payment verification failed.");
                    }
                    // The onSnapshot listener in App.js will automatically update the UI
                } catch (error) {
                    setErrorMessage("Payment verification failed. Please contact support.");
                }
            },
            prefill: {
                name: auth.currentUser.displayName,
                email: auth.currentUser.email,
            },
            theme: { color: "#C8B6FF" }
        };
        
        const rzp = new window.Razorpay(options);
        rzp.open();

    } catch (error) {
        console.error("Payment failed:", error);
        setErrorMessage("Could not initiate payment. Please try again.");
    }
};

/**
 * DEVELOPMENT ONLY: Bypasses the payment flow for testing.
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The current user's ID.
 * @param {function} setErrorMessage - The state setter for displaying errors.
 */
export const handleBypassPayment = async (db, userId, setErrorMessage) => {
    if (!db || !userId) {
        setErrorMessage("You must be logged in to bypass payment.");
        return;
    }
    try {
        const userDocRef = doc(db, 'users', userId);
        await setDoc(userDocRef, { hasPaid: true }, { merge: true });
    } catch (error) {
        console.error("Failed to bypass payment:", error);
        setErrorMessage("Could not update payment status for testing.");
    }
};
