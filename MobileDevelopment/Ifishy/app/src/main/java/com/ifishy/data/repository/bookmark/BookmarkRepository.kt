package com.ifishy.data.repository.bookmark

import android.app.Application
import com.google.gson.Gson
import com.ifishy.R
import com.ifishy.api.ApiService
import com.ifishy.data.model.auth.ErrorResponse
import com.ifishy.data.model.bookmark.BookmarkRequest
import com.ifishy.data.model.bookmark.BookmarkResponse
import com.ifishy.data.model.comments.MessageResponse
import com.ifishy.utils.ResponseState
import com.ifishy.utils.SingleEvent
import dagger.hilt.android.qualifiers.ApplicationContext
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject

interface BookmarkRepository {

    suspend fun getAllBookmark(token: String): ResponseState<BookmarkResponse>
    suspend fun setBookmark(token: String,item:BookmarkRequest): SingleEvent<ResponseState<MessageResponse>>
    suspend fun removeBookmark(token: String,item: BookmarkRequest): SingleEvent<ResponseState<MessageResponse>>

}

class BookmarkRepositoryImpl@Inject constructor(private val apiService: ApiService,@ApplicationContext private val context: Application): BookmarkRepository{
    override suspend fun getAllBookmark(token:String): ResponseState<BookmarkResponse> {
        return try {
            val response = apiService.getAllBookmark("Bearer $token")
            ResponseState.Success(response)
        } catch (e: IOException) {
            ResponseState.Error(context.getString(R.string.no_internet))
        } catch (e: HttpException) {
            val errorResponse = e.response()?.errorBody()?.string()
            val errorMessage = Gson().fromJson(errorResponse, ErrorResponse::class.java)
            ResponseState.Error(errorMessage.message!!)
        }catch (e: IllegalStateException){
            ResponseState.Error(context.getString(R.string.internal_server_error))
        }
    }

    override suspend fun setBookmark(
        token: String,
        item: BookmarkRequest
    ): SingleEvent<ResponseState<MessageResponse>> {
        return try {
            val response = apiService.setBookmark("Bearer $token",item)
            SingleEvent(ResponseState.Success(response))
        } catch (e: IOException) {
            SingleEvent(ResponseState.Error(context.getString(R.string.no_internet)))
        } catch (e: HttpException) {
            val errorResponse = e.response()?.errorBody()?.string()
            val errorMessage = Gson().fromJson(errorResponse, ErrorResponse::class.java)
            SingleEvent(ResponseState.Error(errorMessage.message!!))
        }catch (e: IllegalStateException){
            SingleEvent(ResponseState.Error(context.getString(R.string.internal_server_error)))
        }
    }

    override suspend fun removeBookmark(
        token: String,
        item: BookmarkRequest
    ): SingleEvent<ResponseState<MessageResponse>> {
        return try {
            val response = apiService.deleteBookmark("Bearer $token",item)
            SingleEvent(ResponseState.Success(response))
        } catch (e: IOException) {
            SingleEvent(ResponseState.Error(context.getString(R.string.no_internet)))
        } catch (e: HttpException) {
            val errorResponse = e.response()?.errorBody()?.string()
            val errorMessage = Gson().fromJson(errorResponse, ErrorResponse::class.java)
            SingleEvent(ResponseState.Error(errorMessage.message!!))
        }catch (e: IllegalStateException){
            SingleEvent(ResponseState.Error(context.getString(R.string.internal_server_error)))
        }
    }

}