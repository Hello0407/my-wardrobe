
// При изменении любого файла приложения увеличивайте версию.
const CACHE_PREFIX = `my-wardrobe-shell-${self.registration.scope}-`;

const CACHE_NAME = `${CACHE_PREFIX}v1`;


// Область приложения
const SCOPE = new URL(self.registration.scope);

const INDEX_URL = new URL(
    "./index.html",
    SCOPE
).href;


// Обязательные ресурсы приложения
const APP_URLS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./db.js",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
].map((path) => new URL(path, SCOPE).href);

const APP_URL_SET = new Set(APP_URLS);


// Установка Service Worker
self.addEventListener("install", (event) => {

    event.waitUntil((async () => {

        const cache = await caches.open(CACHE_NAME);

        // Загружаем полный комплект ресурсов.
        // cache.addAll отклоняет установку, если хотя бы
        // один обязательный ресурс не удалось загрузить.

        await cache.addAll(
            APP_URLS.map(
                (url) => new Request(url, {
                    cache: "reload"
                })
            )
        );

    })());

});


// Активация Service Worker
self.addEventListener("activate", (event) => {

    event.waitUntil((async () => {

        const names = await caches.keys();

        // Удаляем только устаревшие кеши
        // этого экземпляра приложения.

        await Promise.all(
            names
                .filter((name) =>
                    name.startsWith(CACHE_PREFIX) &&
                    name !== CACHE_NAME
                )
                .map((name) => caches.delete(name))
        );

    })());

});


// Cache-first для обязательных ресурсов
async function loadAppResource(request, url) {

    const cache = await caches.open(CACHE_NAME);

    const cached = await cache.match(url);

    // Сначала используем установленную версию файла.
    if (cached) {
        return cached;
    }

    // Если файла нет в кеше, обращаемся к сети.
    // Не записываем сетевые ответы в кеш установленной
    // версии: на сервере они уже могут принадлежать
    // следующей версии приложения.

    return fetch(request);

}


// Загрузка главной страницы приложения
async function loadAppPage(request, url) {

    const cache = await caches.open(CACHE_NAME);

    const cached = await cache.match(url);

    // Сначала используем установленную версию страницы.
    if (cached) {
        return cached;
    }

    try {

        return await fetch(request);

    } catch (error) {

        // Если сеть недоступна, используем
        // сохранённый index.html.

        const fallback = await cache.match(INDEX_URL);

        if (fallback) {
            return fallback;
        }

        throw error;

    }

}


// Перехват запросов
self.addEventListener("fetch", (event) => {

    const request = event.request;

    // Обрабатываем только GET-запросы.
    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

    // Не перехватываем сторонние запросы
    // и запросы за пределами приложения.
    if (
        url.origin !== SCOPE.origin ||
        !url.pathname.startsWith(SCOPE.pathname)
    ) {
        return;
    }

    // Навигация внутри приложения.
    if (request.mode === "navigate") {

        const page = new URL(url.href);

        page.search = "";
        page.hash = "";

        // Разрешённые адреса входа:
        // ./ и ./index.html.
        if (
            page.href === SCOPE.href ||
            page.href === INDEX_URL
        ) {

            event.respondWith(
                loadAppPage(request, page.href)
            );

        }

        return;

    }

    // Обязательные файлы приложения.
    if (APP_URL_SET.has(url.href)) {

        event.respondWith(
            loadAppResource(request, url.href)
        );

    }

});
