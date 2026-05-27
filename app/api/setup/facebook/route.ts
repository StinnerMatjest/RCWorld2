import { NextResponse } from "next/server";

export async function GET() {
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", process.env.META_APP_ID!);
  url.searchParams.set("redirect_uri", "http://localhost:3000/api/setup/facebook/callback");
  url.searchParams.set("scope", "pages_show_list,business_management,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish");
  url.searchParams.set("response_type", "code");
  return NextResponse.redirect(url.toString());
}
