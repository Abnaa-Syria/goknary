export const sendOtp = async (recipient: string): Promise<any> => {
  const API_KEY = process.env.WP_SENDER_API_KEY;
  const BASE_URL = process.env.WP_SENDER_BASE_URL;

  const headers = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY || ""
  };

  try {
    const response = await fetch(`${BASE_URL}/otp/send`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        recipient // بنبعت الرقم بس والسيستم هيتكفل بالباقي
      })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error sending OTP:", error);
    throw new Error("فشل إرسال كود التحقق");
  }
};

export const verifyOtp = async (recipient: string, otpCode: string): Promise<any> => {
  const API_KEY = process.env.WP_SENDER_API_KEY;
  const BASE_URL = process.env.WP_SENDER_BASE_URL;

  const headers = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY || ""
  };

  try {
    const response = await fetch(`${BASE_URL}/otp/verify`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        recipient,
        otp_code: otpCode
      })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error verifying OTP:", error);
    throw new Error("فشل التحقق من الكود");
  }
};

