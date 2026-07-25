import { httpRouter } from "convex/server";
import {
  googleCallback,
  googleExchange,
  googleStart
} from "./oauth";
import { paypalCancel, paypalReturn, paypalWebhook } from "./paypal";

const http = httpRouter();

http.route({
  path: "/oauth/google/start",
  method: "GET",
  handler: googleStart
});
http.route({
  path: "/oauth/google/callback",
  method: "GET",
  handler: googleCallback
});
http.route({
  path: "/oauth/google/exchange",
  method: "POST",
  handler: googleExchange
});
http.route({ path: "/paypal/return", method: "GET", handler: paypalReturn });
http.route({ path: "/paypal/cancel", method: "GET", handler: paypalCancel });
http.route({ path: "/paypal/webhook", method: "POST", handler: paypalWebhook });

export default http;
