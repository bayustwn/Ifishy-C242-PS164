package com.ifishy.data.model.auth.response

import com.google.gson.annotations.SerializedName

data class LoginResponse(

    @field:SerializedName("success")
    val success: Boolean? = null,

    @field:SerializedName("message")
    val message: String? = null,

    @field:SerializedName("token")
    private val rootToken: String? = null,

    @field:SerializedName("data")
    val data: LoginData? = null
) {
    /**
     * Resolves token from either root "token" or nested "data.token"
     */
    val token: String?
        get() = rootToken ?: data?.token

    val authToken: String?
        get() = token
}

data class LoginData(
    @field:SerializedName("token")
    val token: String? = null
)
