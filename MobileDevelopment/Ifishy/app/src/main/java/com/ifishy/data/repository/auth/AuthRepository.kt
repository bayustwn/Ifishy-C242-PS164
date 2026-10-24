package com.ifishy.data.repository.auth

import android.app.Application
import com.google.gson.Gson
import com.ifishy.R
import com.ifishy.api.ApiService
import com.ifishy.data.model.auth.ErrorResponse
import com.ifishy.data.model.auth.request.LoginRequest
import com.ifishy.data.model.auth.request.SignUpRequest
import com.ifishy.data.model.auth.response.LoginResponse
import com.ifishy.data.model.auth.response.SignUpResponse
import com.ifishy.utils.ResponseState
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject

interface AuthRepository {
    fun login(userData: LoginRequest): Flow<ResponseState<LoginResponse>>
    fun signUp(userData: SignUpRequest): Flow<ResponseState<SignUpResponse>>
}

class AuthRepositoryImpl @Inject constructor(
    private val apiService: ApiService,
    @ApplicationContext private val context: Application
) : AuthRepository {

    override fun login(userData: LoginRequest): Flow<ResponseState<LoginResponse>> = flow {
        emit(ResponseState.Loading)
        try {
            val response = apiService.login(userData)
            emit(ResponseState.Success(response))
        } catch (e: IOException) {
            emit(ResponseState.Error(context.getString(R.string.no_internet)))
        } catch (e: HttpException) {
            emit(ResponseState.Error(parseHttpError(e)))
        } catch (e: Exception) {
            emit(ResponseState.Error(context.getString(R.string.internal_server_error)))
        }
    }.flowOn(Dispatchers.IO)

    override fun signUp(userData: SignUpRequest): Flow<ResponseState<SignUpResponse>> = flow {
        emit(ResponseState.Loading)
        try {
            val response = apiService.register(userData)
            emit(ResponseState.Success(response))
        } catch (e: IOException) {
            emit(ResponseState.Error(context.getString(R.string.no_internet)))
        } catch (e: HttpException) {
            emit(ResponseState.Error(parseHttpError(e)))
        } catch (e: Exception) {
            emit(ResponseState.Error(context.getString(R.string.internal_server_error)))
        }
    }.flowOn(Dispatchers.IO)

    private fun parseHttpError(e: HttpException): String {
        return try {
            val errorBody = e.response()?.errorBody()?.string()
            val parsed = Gson().fromJson(errorBody, ErrorResponse::class.java)
            parsed?.actualMessage ?: context.getString(R.string.internal_server_error)
        } catch (_: Exception) {
            context.getString(R.string.internal_server_error)
        }
    }
}
