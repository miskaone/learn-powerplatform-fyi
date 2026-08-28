import { notFound } from "next/navigation";
import { LessonPage } from "../../../components/LessonPage";
import { getLessonPage, lessonPages } from "../../../lib/lessonPages";

export const dynamicParams = false;

export function generateStaticParams() {
  return lessonPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = getLessonPage(slug);
  if (!lesson) {
    return { title: "PL-400 Mastery Gate" };
  }
  return {
    title: `${lesson.title} — PL-400 Mastery Gate`,
    description: lesson.governingRule,
  };
}

export default async function LessonSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = getLessonPage(slug);
  if (!lesson) {
    notFound();
  }
  return <LessonPage lesson={lesson} />;
}
