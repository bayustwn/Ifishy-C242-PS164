package com.ifishy.ui.activity.auth

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.util.Patterns
import android.view.View
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import com.ifishy.R
import com.ifishy.data.model.auth.request.SignUpRequest
import com.ifishy.databinding.ActivitySignUpBinding
import com.ifishy.ui.activity.guest.GuestActivity
import com.ifishy.ui.viewmodel.auth.AuthViewModel
import com.ifishy.utils.Dialog
import com.ifishy.utils.ResponseState
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class SignUpActivity : AppCompatActivity(), View.OnClickListener {

    private lateinit var binding: ActivitySignUpBinding
    private val authViewModel by viewModels<AuthViewModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()
        binding = ActivitySignUpBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupListeners()
        setupTextWatchers()
        setupObservers()
    }

    private fun setupListeners() {
        binding.signUpButton.setOnClickListener(this)
        binding.loginButton.setOnClickListener(this)
        binding.guest.setOnClickListener {
            startActivity(Intent(this, GuestActivity::class.java))
        }
    }

    private fun setupTextWatchers() {
        binding.password.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(p0: CharSequence?, p1: Int, p2: Int, p3: Int) {}
            override fun onTextChanged(p0: CharSequence?, p1: Int, p2: Int, p3: Int) {}
            override fun afterTextChanged(pass: Editable?) {
                val password = pass.toString()
                if (password.isNotEmpty() && password.length < 8) {
                    val errorMsg = getString(R.string.password_kurang_dari_8_karakter)
                    binding.passwordContainer.error = errorMsg
                    binding.password.error = errorMsg
                } else {
                    binding.password.error = null
                    binding.passwordContainer.error = null
                }
            }
        })

        binding.email.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(p0: CharSequence?, p1: Int, p2: Int, p3: Int) {}
            override fun onTextChanged(p0: CharSequence?, p1: Int, p2: Int, p3: Int) {}
            override fun afterTextChanged(email: Editable?) {
                val emails = email.toString().trim()
                if (emails.isNotEmpty() && !Patterns.EMAIL_ADDRESS.matcher(emails).matches()) {
                    binding.email.error = getString(R.string.email_tidak_valid)
                } else {
                    binding.email.error = null
                }
            }
        })
    }

    private fun setupObservers() {
        authViewModel.signUpResponse.observe(this) { event ->
            event.getContentIfNotHandled()?.let { response ->
                when (response) {
                    is ResponseState.Loading -> {
                        isLoading(true)
                    }
                    is ResponseState.Success -> {
                        isLoading(false)
                        Dialog.messageDialog(
                            supportFragmentManager,
                            getString(R.string.signup_success),
                            getString(R.string.sign_up_success_desc),
                            okay = applicationContext.getString(R.string.login),
                            onClickListener = {
                                startActivity(
                                    Intent(this@SignUpActivity, LoginActivity::class.java)
                                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                                )
                                finish()
                            }
                        )
                    }
                    is ResponseState.Error -> {
                        isLoading(false)
                        Dialog.messageDialog(
                            supportFragmentManager,
                            message = getString(R.string.signup_error),
                            desc = response.message
                        )
                    }
                }
            }
        }
    }

    private fun isValid(): Boolean {
        val emailValid = binding.email.text.toString().trim().isNotEmpty() && binding.email.error == null
        val usernameValid = binding.username.text.toString().trim().isNotEmpty()
        val passwordText = binding.password.text?.toString() ?: ""
        val passwordValid = passwordText.length >= 8 && binding.password.error == null
        val confirmPassValid = binding.confirmPass.text.toString().isNotEmpty()
        val matchPassword = passwordText == binding.confirmPass.text.toString()

        if (!matchPassword && confirmPassValid) {
            binding.confirmPass.error = "Konfirmasi password tidak cocok"
            return false
        } else {
            binding.confirmPass.error = null
        }

        return emailValid && usernameValid && passwordValid && confirmPassValid && matchPassword
    }

    private fun isLoading(loading: Boolean) {
        if (loading) {
            binding.apply {
                this.loading.visibility = View.VISIBLE
                this.signUpButton.apply {
                    this.text = ""
                    this.isEnabled = false
                }
            }
        } else {
            binding.apply {
                this.loading.visibility = View.GONE
                this.signUpButton.apply {
                    this.text = applicationContext.getString(R.string.sign_up)
                    this.isEnabled = true
                }
            }
        }
    }

    override fun onClick(v: View?) {
        when (v) {
            binding.signUpButton -> {
                if (isValid()) {
                    val userData = SignUpRequest(
                        email = binding.email.text.toString().trim(),
                        username = binding.username.text.toString().trim(),
                        password = binding.password.text.toString(),
                        confirmPassword = binding.confirmPass.text.toString()
                    )
                    authViewModel.signUp(userData)
                } else {
                    Dialog.messageDialog(
                        supportFragmentManager,
                        message = getString(R.string.signup_error),
                        desc = getString(R.string.field_empty)
                    )
                }
            }
            binding.loginButton -> {
                startActivity(Intent(this, LoginActivity::class.java))
                finish()
            }
        }
    }
}
