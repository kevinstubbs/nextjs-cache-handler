import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-gray-800">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-gray-800 sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
          <p>Let's test out nextjs cache handler in all possible scenarios.</p>
          <div className="my-4">
            <h2>GCS Cache Information</h2>
            <ul>
              <li>
                <strong>Bucket:</strong>{" "}
                {(process.env.CACHE_BUCKET || "test-cache-bucket").length > 20
                  ? `${(process.env.CACHE_BUCKET || "test-cache-bucket").substring(0, 20)}...`
                  : process.env.CACHE_BUCKET || "test-cache-bucket"}
              </li>
              <li>
                <strong>Project:</strong>{" "}
                {process.env.GOOGLE_CLOUD_PROJECT || "test-project"}
              </li>
              <li>
                <strong>Emulator:</strong>{" "}
                {process.env.STORAGE_EMULATOR_HOST || "Not set"}
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-3 text-base font-medium sm:grid sm:grid-cols-2 lg:flex lg:flex-row lg:flex-wrap">
          <Link
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] lg:w-[150px]"
            href="/blogs"
          >
            Blogs (ISR)
          </Link>
          <Link
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] lg:w-[150px]"
            href="/about"
          >
            About (SSR)
          </Link>
          <Link
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-purple-600/20 px-5 transition-colors hover:border-purple-600 hover:bg-purple-600/10 dark:border-purple-400/20 dark:hover:border-purple-400 dark:hover:bg-purple-400/10 lg:w-[150px] text-purple-600 dark:text-purple-400"
            href="/ssg-demo"
          >
            SSG Demo
          </Link>
          <Link
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-blue-600/20 px-5 transition-colors hover:border-blue-600 hover:bg-blue-600/10 dark:border-blue-400/20 dark:hover:border-blue-400 dark:hover:bg-blue-400/10 lg:w-[150px] text-blue-600 dark:text-blue-400"
            href="/cache-test"
          >
            Cache Test
          </Link>
          <Link
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] lg:w-[150px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Docs
          </Link>
        </div>
      </main>
    </div>
  );
}
