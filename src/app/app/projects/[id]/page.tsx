import { ProjectDetail } from "@/components/app/projects/ProjectDetail";

export default async function Project({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetail key={id} id={id} />;
}
