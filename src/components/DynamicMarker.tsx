import { Suspense } from "react";
import { connection } from "next/server";

async function Connection() {
  await connection();
  return null;
}

/** Marks an otherwise static page as intentionally request-time, so the store layout's dynamic generateMetadata
 *  (it calls connection()) doesn't block prerendering. Renders nothing. Pattern from the Next 16 generateMetadata docs. */
export default function DynamicMarker() {
  return <Suspense><Connection /></Suspense>;
}
