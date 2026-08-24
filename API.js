 const axios = require("axios");

const api = axios.create({
    baseURL: "http://localhost:3000/api",
    withCredentials: true,
    headers: {
        "Content-Type": "application/json"
    }
});

api.interceptors.response.use(
    response => response,

    error => {
        const response = error.response;

        const normalizedError = new Error(
            response?.data?.message ||
            error.message ||
            "Request failed"
        );

        normalizedError.status = response?.status;
        normalizedError.data = response?.data;
        normalizedError.config = error.config;

        return Promise.reject(normalizedError);
    }
);

module.exports = api;