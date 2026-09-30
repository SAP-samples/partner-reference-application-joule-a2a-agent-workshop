const VCAP = process.env.VCAP_APPLICATION;

export const getA2aServerUrl = (): string =>
    VCAP ? `https://${JSON.parse(VCAP).application_uris[0]}/` : "http://localhost:4004/";
