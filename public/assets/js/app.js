// Service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(error => {
          console.log('Service Worker registration failed:', error);
        });
    });
  }

//   Install App
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Show the install prompt here, e.g., add a button to the UI
    document.querySelector('#install-btn').addEventListener('click', () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(choiceResult => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
        });
    });
});


{
  const e = () => {
    document.documentElement.style.setProperty(
      "--body-scroll-width",
      window.innerWidth - document.documentElement.clientWidth + "px"
    );
  };
  window.addEventListener("resize", e), e();
}
{
  const e = () => {
      setDarkMode(!isDarkMode());
      const e = isDarkMode();
      localStorage.setItem("darkMode", e ? "1" : "0");
    },
    t = (e) => {
      e.checked = isDarkMode();
    };
  document
    .querySelectorAll(
      "[data-darkmode-toggle] input, [data-darkmode-switch] input"
    )
    .forEach((n) => {
      n.addEventListener("change", e), t(n);
    });
}
document.querySelectorAll(".uc-horizontal-scroll").forEach((e) => {
  e.addEventListener("wheel", (t) => {
    t.preventDefault(), e.scrollBy({ left: t.deltaY, behavior: "smooth" });
  });
}),
  document.addEventListener("DOMContentLoaded", () => {
    const e = document.querySelector("[data-uc-backtotop]");
    if (!e) return;
    e.addEventListener("click", (e) => {
      e.preventDefault(), window.scrollTo({ top: 0, behavior: "smooth" });
    });
    let t = 0;
    window.addEventListener("scroll", () => {
      const n = document.body.getBoundingClientRect().top;
      e.parentNode.classList.toggle("uc-active", n <= t), (t = n);
    });
  }),
  document.addEventListener("DOMContentLoaded", function () {
    let e = [].slice.call(document.querySelectorAll("video.video-lazyload"));
    function t(e) {
      let t = e.querySelector("source");
      (t.src = t.dataset.src),
        e.load(),
        (e.muted = !0),
        "visible" === document.visibilityState
          ? e.play()
          : document.addEventListener("visibilitychange", function t() {
              "visible" === document.visibilityState &&
                (e.play(), document.removeEventListener("visibilitychange", t));
            });
    }
    if ("IntersectionObserver" in window) {
      let n = new IntersectionObserver(function (e, o) {
        e.forEach(function (e) {
          if (e.isIntersecting) {
            let o = e.target;
            t(o), n.unobserve(o);
          }
        });
      });
      e.forEach(function (e) {
        n.observe(e),
          e.getBoundingClientRect().top < window.innerHeight &&
            e.getBoundingClientRect().bottom > 0 &&
            (t(e), n.unobserve(e));
      });
    } else
      e.forEach(function (e) {
        t(e);
      });
  });

 
  
