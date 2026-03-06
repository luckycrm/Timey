import { useEffect, useState } from 'react';
import { useSpacetimeDB, useSpacetimeDBQuery } from 'spacetimedb/tanstack';
import { tables } from '../module_bindings';

interface UseOrganizationMembershipOptions {
    enabled?: boolean;
}

export function useOrganizationMembership(
    options: UseOrganizationMembershipOptions = {}
) {
    const { enabled = true } = options;
    const { identity, isActive, connectionError } = useSpacetimeDB();
    const [handshakeExpired, setHandshakeExpired] = useState(false);

    const shouldQuery = enabled && isActive;

    useEffect(() => {
        if (!enabled || shouldQuery || connectionError) {
            setHandshakeExpired(false);
            return;
        }

        const timer = window.setTimeout(() => {
            setHandshakeExpired(true);
        }, 1500);

        return () => window.clearTimeout(timer);
    }, [connectionError, enabled, shouldQuery]);

    const [allMemberships, membershipsLoading] = useSpacetimeDBQuery(
        shouldQuery ? tables.organization_member : 'skip'
    );

    const [allUsers, usersLoading] = useSpacetimeDBQuery(
        shouldQuery ? tables.user : 'skip'
    );

    const currentUser = identity == null
        ? null
        : allUsers.find((u) => u.identity.isEqual(identity));

    const memberships =
        currentUser == null
            ? []
            : allMemberships.filter((membership) =>
                membership.userId === currentUser.id
            );

    const isCheckingMembership = enabled &&
        !connectionError &&
        (membershipsLoading || usersLoading || (!shouldQuery && !handshakeExpired));

    return {
        memberships,
        hasOrganization: memberships.length > 0,
        isCheckingMembership,
        membershipUnavailable: enabled && (!!connectionError || handshakeExpired),
    };
}
