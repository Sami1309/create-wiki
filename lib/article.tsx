import ReactMarkdown from "react-markdown";
import { wikiToMarkdown } from "./markup";

// Renders article markdown (after converting [[wiki links]] into real links).
export function Article({ content }: { content: string }) {
  return (
    <div className="article-body">
      <ReactMarkdown>{wikiToMarkdown(content)}</ReactMarkdown>
    </div>
  );
}
