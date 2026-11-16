/** Animate only newly mounted words from real server chunks. Existing words keep
 * their keys, so incoming chunks do not replay the whole answer animation. */
export function StreamingReply({ text }: { text: string }) {
  return <p className="raahi-streaming-reply whitespace-pre-wrap text-sm leading-relaxed">
    <span className="sr-only">{text}</span>
    <span aria-hidden="true">{text.split(/(\s+)/u).map((word, index) =>
      /^\s+$/u.test(word) ? word : <span className="raahi-reply-word" key={index} style={{ animationDelay: `${(index % 8) * 20}ms` }}>{word}</span>,
    )}</span>
    <span className="raahi-reply-cursor" aria-hidden="true" />
  </p>;
}
