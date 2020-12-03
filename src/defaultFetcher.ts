export default async function fetcher(
  url: string,
  options?: { headers?: object }
) {
  const res = await fetch(url, {
    ...options,
    headers: { ...options?.headers, "x-fusion-publish": "1" },
  });

  if (!res.ok) {
    throw new Error("Network response was not ok");
  }

  const preparsedHeaders = res.headers.get("x-fusion-publication");

  if (preparsedHeaders === null) {
    throw new Error("Fusion publication header was not in response");
  }

  const header = JSON.parse(preparsedHeaders);

  if (!header) {
    throw new Error("Fusion publication header was malformed in response");
  }

  return { data: await res.json(), header };
}
