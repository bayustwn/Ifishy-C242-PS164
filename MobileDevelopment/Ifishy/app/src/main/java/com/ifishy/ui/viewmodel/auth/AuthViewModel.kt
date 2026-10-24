package com.ifishy.ui.viewmodel.auth

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ifishy.data.model.auth.request.LoginRequest
import com.ifishy.data.model.auth.request.SignUpRequest
import com.ifishy.data.model.auth.response.LoginResponse
import com.ifishy.data.model.auth.response.SignUpResponse
import com.ifishy.data.repository.auth.AuthRepository
import com.ifishy.utils.ResponseState
import com.ifishy.utils.SingleEvent
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Named

@HiltViewModel
class AuthViewModel @Inject constructor(
    @Named("AuthRepository") private val authRepository: AuthRepository
) : ViewModel() {

    private val _loginResponse = MutableLiveData<SingleEvent<ResponseState<LoginResponse>>>()
    val loginResponse: LiveData<SingleEvent<ResponseState<LoginResponse>>> = _loginResponse

    private val _signUpResponse = MutableLiveData<SingleEvent<ResponseState<SignUpResponse>>>()
    val signUpResponse: LiveData<SingleEvent<ResponseState<SignUpResponse>>> = _signUpResponse

    // Modern Kotlin Flow streams for coroutine callers
    private val _loginFlow = MutableSharedFlow<ResponseState<LoginResponse>>()
    val loginFlow = _loginFlow.asSharedFlow()

    private val _signUpFlow = MutableSharedFlow<ResponseState<SignUpResponse>>()
    val signUpFlow = _signUpFlow.asSharedFlow()

    fun userLogin(userData: LoginRequest) {
        viewModelScope.launch {
            authRepository.login(userData).collect { state ->
                _loginFlow.emit(state)
                _loginResponse.value = SingleEvent(state)
            }
        }
    }

    fun signUp(userData: SignUpRequest) {
        viewModelScope.launch {
            authRepository.signUp(userData).collect { state ->
                _signUpFlow.emit(state)
                _signUpResponse.value = SingleEvent(state)
            }
        }
    }
}
