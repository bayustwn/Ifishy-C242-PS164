package com.ifishy.data.model.auth

import com.google.gson.annotations.SerializedName

data class ErrorResponse(

    @field:SerializedName("success")
    val success: Boolean? = null,

    @field:SerializedName("message")
    private val rawMessage: String? = null,

    @field:SerializedName("error")
    val error: ErrorDetail? = null
) {
    val message: String
        get() = rawMessage ?: error?.message ?: "Terjadi kesalahan pada server"

    val actualMessage: String
        get() = message
}

data class ErrorDetail(

    @field:SerializedName("code")
    val code: String? = null,

    @field:SerializedName("message")
    val message: String? = null
)
