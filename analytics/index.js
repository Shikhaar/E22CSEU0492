const express = require("express");
const axios = require("axios");
require("dotenv").config();
const NodeCache = require("node-cache");

const app = express();
const SERVER_PORT = process.env.PORT || 3000;
const API_BASE = process.env.BASE_URL;
const API_TOKEN = process.env.AUTH_TOKEN;

const cacheStore = new NodeCache({ stdTTL: 60, checkperiod: 120 });

const httpClient = axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${API_TOKEN}` }
});

const getCachedData = async (url, key, ttl = 60) => {
    const cachedResult = cacheStore.get(key);
    if (cachedResult) return cachedResult;

    const response = await httpClient.get(url);
    const responseData = response.data;
    if (!responseData || typeof responseData !== "object") throw new Error(`Invalid response from ${url}`);
    cacheStore.set(key, responseData, ttl);
    return responseData;
};

const fetchUsers = async () => {
    const data = await getCachedData("/users", "users_list");
    return Object.entries(data.users || {}).map(([uid, uname]) => ({
        id: parseInt(uid),
        name: uname
    }));
};

const retrieveUserPosts = async () => {
    const cacheKey = "user_posts_data";
    const cachedResult = cacheStore.get(cacheKey);
    if (cachedResult) return cachedResult;

    const users = await fetchUsers();
    const postList = await Promise.all(
        users.map(async ({ id, name }) => {
            try {
                const postData = await getCachedData(`/users/${id}/posts`, `posts_${id}`, 30);
                return { userId: id, userName: name, posts: postData.posts || [] };
            } catch {
                return { userId: id, userName: name, posts: [] };
            }
        })
    );

    cacheStore.set(cacheKey, postList, 30);
    return postList;
};

const fetchPostComments = async (postId) => {
    try {
        const { comments } = await httpClient.get(`/posts/${postId}/comments`).then(res => res.data);
        return comments || [];
    } catch {
        return [];
    }
};

app.get("/users", async (req, res) => {
    try {
        const userData = await retrieveUserPosts();
        const topContributors = userData
            .map(({ userId, userName, posts }) => ({
                userId,
                name: userName,
                postCount: posts.length
            }))
            .sort((a, b) => b.postCount - a.postCount)
            .slice(0, 5);

        res.json({ topContributors });
    } catch (err) {
        res.status(500).json({ error: "Unable to retrieve top contributors", details: err.message });
    }
});

app.get("/posts", async (req, res) => {
    const { category } = req.query;

    if (!["popular", "latest"].includes(category)) {
        return res.status(400).json({
            error: "Query parameter 'category' must be either 'popular' or 'latest'"
        });
    }

    try {
        const userPosts = await retrieveUserPosts();
        const allPosts = userPosts.flatMap(u => u.posts);

        if (category === "latest") {
            const latestPosts = allPosts.sort((a, b) => b.id - a.id).slice(0, 5);
            return res.json(latestPosts);
        }

        if (category === "popular") {
            const postsWithComments = await Promise.all(
                allPosts.map(async (post) => {
                    const comments = await fetchPostComments(post.id);
                    return { ...post, commentCount: comments.length };
                })
            );

            const mostDiscussed = postsWithComments.sort((a, b) => b.commentCount - a.commentCount).slice(0, 5);
            return res.json(mostDiscussed);
        }
    } catch (err) {
        res.status(500).json({
            error: "Error retrieving posts",
            details: err.message
        });
    }
});

app.listen(SERVER_PORT, () => {
    console.log(`API server running at http://localhost:${SERVER_PORT}`);
});
