# 6064 Holdings

A minimal static holding-company page for **6064holdings.com**. The page has no
build step and no dependencies.

## Local preview

From the repository root:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000/>.

## Deploy with GitHub Pages

These instructions describe setup; they do not confirm that the site is
already deployed.

1. Push this repository to GitHub with the site at the root of the `main`
   branch.
2. In the repository, open **Settings → Pages**. Under **Build and deployment**,
   choose **Deploy from a branch**, then select **`main`** and **`/ (root)`**.
3. In **Custom domain**, enter `6064holdings.com` and save it **before** making
   DNS changes. The committed `CNAME` file should also contain exactly
   `6064holdings.com`.
4. At Spaceship, open **Advanced DNS**, select `6064holdings.com`, and open
   **DNS records → Custom records**. Add these DNS records:

   | Type | Host | Value |
   | --- | --- | --- |
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | AAAA | `@` | `2606:50c0:8000::153` |
   | AAAA | `@` | `2606:50c0:8001::153` |
   | AAAA | `@` | `2606:50c0:8002::153` |
   | AAAA | `@` | `2606:50c0:8003::153` |
   | CNAME | `www` | `chiffre970.github.io` |

   The `www` target is `chiffre970.github.io`, not a repository path.

5. Preserve any existing mail records (such as MX and mail-related TXT records)
   and all unrelated DNS records.
6. After DNS resolves and GitHub finishes provisioning the certificate, enable
   **Enforce HTTPS** in the Pages settings.

Official reference: [Managing a custom domain for your GitHub Pages
site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

## Animation

The centerpiece is a slowly rotating, lightly shaded ASCII pyramid rendered on
a high-DPI canvas. Points are sampled deterministically across the four
triangular faces of a square-based pyramid, back faces are hidden, and the
visible surfaces use light and face normals to vary the opacity of a restrained
`. : + *` glyph palette. The full turn takes about 24 seconds.

The animation follows `prefers-reduced-motion` and renders a single static
frame when reduced motion is requested. It pauses while the page is hidden.
Before JavaScript runs, or if canvas rendering is unavailable, a static
plain-text pyramid is shown instead.
