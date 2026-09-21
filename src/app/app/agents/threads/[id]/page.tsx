// /app/agents/threads/[id] — view an existing thread, with the chat composer

import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { ThreadView } from "./_thread";
import { PageHeader } from "../../../_components/page-header";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const thread = await prisma.agentThread.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: { agent: true }
  });
  if (!thread) notFound();

  const initialMessages = await prisma.agentMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "asc" },
    take: 100
  });

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title={thread.title}
        subtitle={`with ${thread.agent.name} (${thread.agent.role})`}
      />
      <ThreadView
        threadId={thread.id}
        agentName={thread.agent.name}
        agentRole={thread.agent.role}
        initialMessages={initialMessages.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
          role: m.role as "user" | "assistant" | "system" | "tool"
        }))}
      />
    </div>
  );
}
