import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Необходима авторизация" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify JWT token
    const supabase = createClient(supabaseUrl, supabaseKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Пользователь не авторизован" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { order_id, amount, description, items, customer_email } = await req.json();

    if (!order_id || !amount) {
      return new Response(
        JSON.stringify({ error: "Не указаны order_id или amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // YooKassa credentials
    const shopId = Deno.env.get("YOOKASSA_SHOP_ID");
    const secretKey = Deno.env.get("YOOKASSA_SECRET_KEY");

    if (!shopId || !secretKey) {
      console.error("YooKassa credentials not configured");
      return new Response(
        JSON.stringify({ error: "Платёжная система не настроена" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create payment via YooKassa API
    const idempotenceKey = crypto.randomUUID();

    const paymentBody = {
      amount: {
        value: amount.toFixed(2),
        currency: "RUB",
      },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: "https://lumscandle.ru/order-success/?order_id=" + order_id,
      },
      description: description || ("Заказ " + order_id + " — ЛЮМС"),
      metadata: {
        order_id: order_id,
        user_id: user.id,
      },
      receipt: {
        customer: {
          email: customer_email || user.email,
        },
        items: (items || []).map((item: { name: string; price: number; qty: number }) => ({
          description: item.name,
          quantity: String(item.qty),
          amount: {
            value: item.price.toFixed(2),
            currency: "RUB",
          },
          vat_code: 1,
        })),
      },
    };

    const yooResponse = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": idempotenceKey,
        "Authorization": "Basic " + btoa(shopId + ":" + secretKey),
      },
      body: JSON.stringify(paymentBody),
    });

    const yooData = await yooResponse.json();

    if (!yooResponse.ok) {
      console.error("YooKassa error:", JSON.stringify(yooData));
      return new Response(
        JSON.stringify({ error: "Ошибка создания платежа", details: yooData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save payment_id to order in DB
    await supabase
      .from("orders")
      .update({
        payment_id: yooData.id,
        payment_status: yooData.status,
      })
      .eq("id", order_id);

    // Return confirmation URL
    return new Response(
      JSON.stringify({
        payment_id: yooData.id,
        confirmation_url: yooData.confirmation.confirmation_url,
        status: yooData.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Внутренняя ошибка сервера" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
