export const getCacheKey = (name: string, value?: string) => {
  return value ? `${name}-${value}` : name;
};
