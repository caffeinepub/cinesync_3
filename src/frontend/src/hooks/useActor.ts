import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { backendInterface } from "../backend";
import { createActorWithConfig } from "../config";
import { getSecretParameter } from "../utils/urlParams";
import { useInternetIdentity } from "./useInternetIdentity";

const ACTOR_QUERY_KEY = "actor";
export function useActor() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const actorQuery = useQuery<backendInterface>({
    queryKey: [ACTOR_QUERY_KEY, identity?.getPrincipal().toString()],
    queryFn: async () => {
      const isAuthenticated = !!identity;

      let actor: backendInterface;
      if (!isAuthenticated) {
        actor = await createActorWithConfig();
      } else {
        actor = await createActorWithConfig({ agentOptions: { identity } });
        // Fire-and-forget — never block actor resolution on this call
        const adminToken = getSecretParameter("caffeineAdminToken") || "";
        actor._initializeAccessControlWithSecret(adminToken).catch(() => {});
      }
      return actor;
    },
    staleTime: Number.POSITIVE_INFINITY,
    enabled: true,
    retry: 3,
    retryDelay: (attempt) => 1500 * attempt,
  });

  useEffect(() => {
    if (actorQuery.data) {
      queryClient.invalidateQueries({
        predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY),
      });
      queryClient.refetchQueries({
        predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY),
      });
    }
  }, [actorQuery.data, queryClient]);

  return {
    actor: actorQuery.data || null,
    isFetching: actorQuery.isFetching,
    isError: actorQuery.isError,
    refetch: () => actorQuery.refetch(),
  };
}
