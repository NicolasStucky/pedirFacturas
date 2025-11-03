import PROVIDERS from '../constants/providers.js';

export function listProviders(_req, res) {
  res.json({
    providers: PROVIDERS
  });
}

export default {
  listProviders
};
