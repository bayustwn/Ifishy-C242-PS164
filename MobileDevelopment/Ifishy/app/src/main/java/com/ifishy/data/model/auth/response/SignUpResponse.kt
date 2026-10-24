package com.ifishy.data.model.auth.response

import com.google.gson.annotations.SerializedName

data class SignUpResponse(

    @field:SerializedName("success")
    val success: Boolean? = null,

    @field:SerializedName("message")
    val message: String? = null,

    @field:SerializedName("user")
    val user: User? = null,

    @field:SerializedName("data")
    val data: User? = null
) {
    val registeredUser: User?
        get() = user ?: data
}

data class User(

    @field:SerializedName("id")
    val id: String? = null,

    @field:SerializedName("email")
    val email: String? = null,

    @field:SerializedName("username")
    val username: String? = null
)
