(() => {
  if (!window.location.hostname.endsWith('.github.io')) return;

  const publicBackendUrl = 'https://ssvdnn5sq0amjs370rfm7.apigateway-cn-beijing.volceapi.com';
  const mediaPathPattern = /^\.?\/?assets\/(?:audio|video)\//;

  const publicMediaUrl = (value) => {
    if (!value || !mediaPathPattern.test(value)) return value;
    return `${publicBackendUrl}/${value.replace(/^\.?\//, '')}`;
  };

  const rewriteMediaElement = (element) => {
    if (!(element instanceof Element)) return;
    if (element.hasAttribute('src')) {
      const currentSource = element.getAttribute('src');
      const publicSource = publicMediaUrl(currentSource);
      if (publicSource !== currentSource) element.setAttribute('src', publicSource);
    }
    element.querySelectorAll?.('[src]').forEach(rewriteMediaElement);
  };

  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes') rewriteMediaElement(mutation.target);
      mutation.addedNodes.forEach(rewriteMediaElement);
    });
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

  window.addEventListener('DOMContentLoaded', () => rewriteMediaElement(document.body), { once: true });
  window.zhiyinPublicMediaUrl = publicMediaUrl;
})();
