import { useEdges } from "@xyflow/react";

/** Returns true if the given node id is reachable from the source node via the pipeline chain. */
export function useIsInPipeline(id: string): boolean {
  const edges = useEdges();
  const edgeMap = new Map(edges.map((e) => [e.source, e.target]));
  let current: string | undefined = "source";
  while (current) {
    if (current === id) return true;
    current = edgeMap.get(current);
  }
  return false;
}
