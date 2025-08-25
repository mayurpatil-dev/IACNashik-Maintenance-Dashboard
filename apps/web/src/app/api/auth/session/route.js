import { getToken } from '@auth/core/jwt';

export async function GET() {
  try {
    const response = await fetch("https://script.google.com/macros/s/AKfycbxT_VzkKxpOVgzvSpXf-ksaZ7mhPBEKORV4cnAOIPMYwbMmfUl0239W_rrT20NbIwX9HA/exec");
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({error: "Failed to fetch data."}), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}