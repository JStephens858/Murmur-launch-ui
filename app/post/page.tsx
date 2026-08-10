import { redirect } from "next/navigation";

/**
 * `/post` with no id.
 *
 * Legacy served the plain landing page here, with a comment explaining why: an
 * empty post link should either open the app (via the universal link) or land on
 * the homepage if the app isn't installed. A redirect to / is the same intent,
 * without serving the homepage from a second URL.
 */
export default function PostIndexRoute() {
  redirect("/");
}
