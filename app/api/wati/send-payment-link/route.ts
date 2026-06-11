import { NextResponse } from "next/server";

function normalizeSaudiMobile(mobile: string) {
  const digits = String(mobile || "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("05")) return `966${digits.slice(1)}`;
  if (digits.startsWith("5")) return `966${digits}`;

  return digits;
}

function getAuthHeader(token: string) {
  const cleanToken = String(token || "").trim();

  if (cleanToken.startsWith("Bearer ")) {
    return cleanToken;
  }

  return `Bearer ${cleanToken}`;
}

function cleanBaseUrl(baseUrl: string) {
  return String(baseUrl || "").replace(/\/$/, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { customerMobile, customerName, patientName, amount, paymentLink } =
      body;

    if (!customerMobile) {
      return NextResponse.json(
        { success: false, message: "Customer mobile is required." },
        { status: 400 }
      );
    }

    if (!amount) {
      return NextResponse.json(
        { success: false, message: "Amount is required." },
        { status: 400 }
      );
    }

    if (!paymentLink) {
      return NextResponse.json(
        { success: false, message: "Payment link is required." },
        { status: 400 }
      );
    }

    const baseUrl = process.env.WATI_BASE_URL;
    const token = process.env.WATI_API_TOKEN;
    const templateName = process.env.WATI_PAYMENT_TEMPLATE;

    if (!baseUrl || !token || !templateName) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Missing WATI settings. Check WATI_BASE_URL, WATI_API_TOKEN, and WATI_PAYMENT_TEMPLATE.",
        },
        { status: 500 }
      );
    }

    const phone = normalizeSaudiMobile(customerMobile);

    if (!phone || phone.length < 9) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid customer mobile number.",
          phone,
        },
        { status: 400 }
      );
    }

    const url = `${cleanBaseUrl(
      baseUrl
    )}/api/v1/sendTemplateMessage?whatsappNumber=${phone}`;

    const payload = {
      template_name: templateName,
      broadcast_name: `b2c_payment_${Date.now()}`,
      parameters: [
        {
          name: "customer_name",
          value: customerName || "Customer",
        },
        {
          name: "patient_name",
          value: patientName || "—",
        },
        {
          name: "amount",
          value: String(amount),
        },
        {
          name: "payment_link",
          value: paymentLink,
        },
      ],
    };

    console.log("Sending WATI payment link:", {
      url,
      phone,
      templateName,
      payload,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(token),
        "Content-Type": "application/json-patch+json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    let data: any = null;

    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    if (!response.ok) {
      console.error("WATI API error:", {
        status: response.status,
        data,
        sentPayload: payload,
      });

      const itemError = Array.isArray(data?.items) ? data.items[0] : null;

      return NextResponse.json(
        {
          success: false,
          message:
            itemError?.description ||
            data?.message ||
            data?.error ||
            data?.errors?.[0]?.message ||
            "WATI API failed.",
          status: response.status,
          data,
          sentPayload: payload,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Payment link sent successfully.",
      data,
    });
  } catch (error: any) {
    console.error("WATI payment link error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to send payment link.",
      },
      { status: 500 }
    );
  }
}