/* eslint-disable @typescript-eslint/no-explicit-any */
import axiosFactory, { AxiosError } from "axios";

const retryDelay = 1000;

export const http = axiosFactory.create({
  headers: {
    "x-agent": "automod",
  },
});

http.interceptors.response.use(undefined, function axiosRetryInterceptor(err) {
  const config = err.config;

  console.error({
    status: err.response?.status,
    data: JSON.stringify(err.response?.data),
  });

  if (
    err.response?.status &&
    (err.response.status === 429 || err.response.status >= 500) &&
    !config.__retryCount
  ) {
    config.__retryCount = 0;
  }

  if (config.__retryCount < 3) {
    // Max retry limit
    config.__retryCount += 1;
    const backoffDelay = getDelay(err, config.__retryCount);
    console.warn(`Received HTTP ${err.response.status}, retrying in ${backoffDelay}ms`);

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(http(config));
      }, backoffDelay);
    });
  }

  return Promise.reject(err);
});

function getDelay(err: AxiosError, retryCount: number) {
  if (err.response?.status === 429 && err.config?.url?.includes("neynar")) {
    return 2 ** retryCount * 30_000;
  }

  return 2 ** retryCount * retryDelay;
}
