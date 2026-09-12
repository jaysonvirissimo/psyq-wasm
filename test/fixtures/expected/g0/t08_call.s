	.file	1 "t08_call.c"
gcc2_compiled.:
__gnu_compiled_c:
	.text
	.align	2
	.globl	call1
	.ent	call1
call1:
	.frame	$sp,24,$31		# vars= 0, regs= 1/0, args= 16, extra= 0
	.mask	0x80000000,-8
	.fmask	0x00000000,0
	subu	$sp,$sp,24
	sw	$31,16($sp)
	.set	noreorder
	.set	nomacro
	jal	callee
	addu	$5,$4,1
	.set	macro
	.set	reorder

	lw	$31,16($sp)
	sll	$2,$2,1
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,24
	.set	macro
	.set	reorder

	.end	call1
	.align	2
	.globl	call_many
	.ent	call_many
call_many:
	.frame	$sp,32,$31		# vars= 0, regs= 1/0, args= 24, extra= 0
	.mask	0x80000000,-8
	.fmask	0x00000000,0
	mult	$4,$5
	subu	$sp,$sp,32
	li	$2,42			# 0x0000002a
	addu	$6,$4,$5
	subu	$7,$4,$5
	sw	$31,24($sp)
	sw	$2,20($sp)
	mflo	$3
	#nop
	.set	noreorder
	.set	nomacro
	jal	callee6
	sw	$3,16($sp)
	.set	macro
	.set	reorder

	lw	$31,24($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,32
	.set	macro
	.set	reorder

	.end	call_many
	.align	2
	.globl	call_local
	.ent	call_local
call_local:
	.frame	$sp,32,$31		# vars= 8, regs= 1/0, args= 16, extra= 0
	.mask	0x80000000,-8
	.fmask	0x00000000,0
	subu	$sp,$sp,32
	li	$2,5			# 0x00000005
	addu	$4,$sp,16
	sw	$31,24($sp)
	.set	noreorder
	.set	nomacro
	jal	take_ptr
	sw	$2,16($sp)
	.set	macro
	.set	reorder

	lw	$2,16($sp)
	lw	$31,24($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,32
	.set	macro
	.set	reorder

	.end	call_local
	.align	2
	.globl	chain
	.ent	chain
chain:
	.frame	$sp,24,$31		# vars= 0, regs= 2/0, args= 16, extra= 0
	.mask	0x80010000,-4
	.fmask	0x00000000,0
	subu	$sp,$sp,24
	sw	$16,16($sp)
	move	$16,$4
	sw	$31,20($sp)
	.set	noreorder
	.set	nomacro
	jal	callee
	li	$5,1			# 0x00000001
	.set	macro
	.set	reorder

	move	$4,$16
	li	$5,2			# 0x00000002
	.set	noreorder
	.set	nomacro
	jal	callee
	move	$16,$2
	.set	macro
	.set	reorder

	move	$4,$16
	.set	noreorder
	.set	nomacro
	jal	callee
	move	$5,$2
	.set	macro
	.set	reorder

	lw	$31,20($sp)
	lw	$16,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,24
	.set	macro
	.set	reorder

	.end	chain
	.align	2
	.ent	helper
helper:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sll	$2,$4,1
	addu	$2,$2,$4
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$2,$2,1
	.set	macro
	.set	reorder

	.end	helper
	.align	2
	.globl	use_helper
	.ent	use_helper
use_helper:
	.frame	$sp,24,$31		# vars= 0, regs= 2/0, args= 16, extra= 0
	.mask	0x80010000,-4
	.fmask	0x00000000,0
	subu	$sp,$sp,24
	sw	$16,16($sp)
	sw	$31,20($sp)
	.set	noreorder
	.set	nomacro
	jal	helper
	move	$16,$5
	.set	macro
	.set	reorder

	move	$4,$16
	.set	noreorder
	.set	nomacro
	jal	helper
	move	$16,$2
	.set	macro
	.set	reorder

	addu	$2,$16,$2
	lw	$31,20($sp)
	lw	$16,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,24
	.set	macro
	.set	reorder

	.end	use_helper
	.align	2
	.globl	recursive
	.ent	recursive
recursive:
	.frame	$sp,24,$31		# vars= 0, regs= 2/0, args= 16, extra= 0
	.mask	0x80010000,-4
	.fmask	0x00000000,0
	subu	$sp,$sp,24
	sw	$16,16($sp)
	move	$16,$4
	slt	$2,$16,2
	.set	noreorder
	.set	nomacro
	bne	$2,$0,$L8
	sw	$31,20($sp)
	.set	macro
	.set	reorder

	.set	noreorder
	.set	nomacro
	jal	recursive
	addu	$4,$16,-1
	.set	macro
	.set	reorder

	mult	$16,$2
	mflo	$2
	#nop
	j	$L9
$L8:
	li	$2,1			# 0x00000001
$L9:
	lw	$31,20($sp)
	lw	$16,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,24
	.set	macro
	.set	reorder

	.end	recursive

	.text
