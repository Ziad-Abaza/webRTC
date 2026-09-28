<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\MeetingController;

Route::get('/', [MeetingController::class, 'index'])->name('meetings.index');
Route::post('/meetings', [MeetingController::class, 'store'])->name('meetings.store');
Route::get('/room/{slug}', [MeetingController::class, 'show'])->name('meetings.show');

// Invitations API (Host Actions)
Route::post('/room/{slug}/invitations', [MeetingController::class, 'createInvitation'])->name('meetings.invitations.create');
Route::get('/room/{slug}/invitations', [MeetingController::class, 'listInvitations'])->name('meetings.invitations.list');
Route::post('/room/{slug}/invitations/{code}/revoke', [MeetingController::class, 'revokeInvitation'])->name('meetings.invitations.revoke');

// Invitee Join Flow
Route::get('/join/{code}', [MeetingController::class, 'showJoin'])->name('meetings.join');
Route::post('/join/{code}', [MeetingController::class, 'processJoin'])->name('meetings.join.process');

