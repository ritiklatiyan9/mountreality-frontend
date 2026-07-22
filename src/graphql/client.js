/**
 * Apollo Client — dashboard-only GraphQL layer.
 * Reuses existing JWT token from AuthContext.
 */
import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = new HttpLink({
  uri: `${import.meta.env.VITE_API_URL || 'https://rgaccountbackend.onrender.com'}/graphql`,
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('accessToken');
  const sessionId = localStorage.getItem('sessionId');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
      ...(sessionId ? { 'X-Session-ID': sessionId } : {}),
    },
  };
});

export const apolloClient = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          kpiCards: {
            // Cache per siteId + range combo
            keyArgs: ['siteId', 'range', ['start', 'end'], 'excludeOldPlots'],
          },
          revenueVsExpense: {
            keyArgs: ['siteId', 'range', ['start', 'end'], 'resolution', 'excludeOldPlots'],
          },
          profitTrend: {
            keyArgs: ['siteId', 'range', ['start', 'end'], 'resolution', 'excludeOldPlots'],
          },
          verifyFinancialIntegrity: {
            keyArgs: ['siteId', 'range', ['start', 'end']],
          },
          plotPageData: {
            keyArgs: ['siteId'],
          },
          plotPaymentDetail: {
            keyArgs: ['plotId', 'siteId'],
          },
          registryBankChequePayments: {
            keyArgs: ['siteId'],
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
    },
  },
});
