import { Suspense } from "react";
import PostsIndex, { postsIndexMetadata } from "@/components/store/PostsIndex";

type Props = PageProps<"/blog">;

export const generateMetadata = ({ searchParams }: Props) => postsIndexMetadata("blog", searchParams);

export default function BlogIndex({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 text-muted" role="status">Loading…</div>}>
      <PostsIndex kind="blog" searchParams={searchParams} />
    </Suspense>
  );
}
