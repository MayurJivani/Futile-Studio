/**
 * A site path, prefixed with the build's base. Production builds at `/`; a
 * staging build lives under `staging.futile.studio/<site>/`, and a hard-coded
 * `/cv.pdf` there would point at the staging root instead of this site.
 */
export const url = (path = '') => import.meta.env.BASE_URL.replace(/\/?$/, '/') + path.replace(/^\//, '');
