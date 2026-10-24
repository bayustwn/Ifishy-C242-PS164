package com.ifishy.data.model.auth

import com.google.gson.Gson
import com.ifishy.data.model.auth.response.LoginResponse
import com.ifishy.data.model.auth.response.SignUpResponse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class AuthResponseTest {

    private lateinit var gson: Gson

    @Before
    fun setUp() {
        gson = Gson()
    }

    @Test
    fun loginResponse_fromNestedDataToken_extractsTokenSuccessfully() {
        // Format dari backend Cloud yang baru: token di dalam object "data"
        val json = """
            {
                "success": true,
                "data": {
                    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token"
                },
                "message": "Login successful"
            }
        """.trimIndent()

        val response = gson.fromJson(json, LoginResponse::class.java)

        assertNotNull(response)
        assertEquals(true, response.success)
        assertEquals("Login successful", response.message)
        assertEquals("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token", response.authToken)
        assertEquals("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token", response.token)
    }

    @Test
    fun loginResponse_fromRootToken_extractsTokenSuccessfully() {
        // Format legacy: token di root JSON
        val json = """
            {
                "success": true,
                "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.legacy_token",
                "message": "Login successful"
            }
        """.trimIndent()

        val response = gson.fromJson(json, LoginResponse::class.java)

        assertNotNull(response)
        assertEquals("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.legacy_token", response.authToken)
        assertEquals("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.legacy_token", response.token)
    }

    @Test
    fun loginResponse_missingToken_returnsNullWithoutException() {
        val json = """
            {
                "success": false,
                "message": "Missing credentials"
            }
        """.trimIndent()

        val response = gson.fromJson(json, LoginResponse::class.java)

        assertNotNull(response)
        assertNull(response.authToken)
        assertNull(response.token)
    }

    @Test
    fun errorResponse_fromNestedErrorObject_extractsMessageSafely() {
        // Format backend saat ini: { success: false, error: { code: "...", message: "..." } }
        val json = """
            {
                "success": false,
                "error": {
                    "code": "INVALID_CREDENTIALS",
                    "message": "Invalid email or password"
                }
            }
        """.trimIndent()

        val errorResponse = gson.fromJson(json, ErrorResponse::class.java)

        assertNotNull(errorResponse)
        assertEquals(false, errorResponse.success)
        assertEquals("Invalid email or password", errorResponse.actualMessage)
        assertEquals("Invalid email or password", errorResponse.message)
    }

    @Test
    fun errorResponse_fromRootMessage_extractsMessageSafely() {
        // Format error legacy: { success: false, message: "..." }
        val json = """
            {
                "success": false,
                "message": "Akun tidak ditemukan"
            }
        """.trimIndent()

        val errorResponse = gson.fromJson(json, ErrorResponse::class.java)

        assertNotNull(errorResponse)
        assertEquals("Akun tidak ditemukan", errorResponse.actualMessage)
        assertEquals("Akun tidak ditemukan", errorResponse.message)
    }

    @Test
    fun errorResponse_emptyJson_returnsFallbackMessage() {
        val json = "{}"
        val errorResponse = gson.fromJson(json, ErrorResponse::class.java)

        assertNotNull(errorResponse)
        assertEquals("Terjadi kesalahan pada server", errorResponse.actualMessage)
        assertEquals("Terjadi kesalahan pada server", errorResponse.message)
    }

    @Test
    fun signUpResponse_withPostgresUuid_parsesWithoutException() {
        // Backend PostgreSQL menggunakan UUID String untuk ID user
        val json = """
            {
                "success": true,
                "message": "User successfully registered!",
                "data": {
                    "id": "7b86ce1b-2c82-4cc3-b49b-f87ece08398b",
                    "email": "tester@ifishy.com",
                    "username": "tester"
                }
            }
        """.trimIndent()

        val response = gson.fromJson(json, SignUpResponse::class.java)

        assertNotNull(response)
        assertEquals(true, response.success)
        assertNotNull(response.registeredUser)
        assertEquals("7b86ce1b-2c82-4cc3-b49b-f87ece08398b", response.registeredUser?.id)
        assertEquals("tester@ifishy.com", response.registeredUser?.email)
    }
}
